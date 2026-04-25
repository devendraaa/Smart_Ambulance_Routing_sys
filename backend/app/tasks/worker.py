import queue
import threading
from typing import Any
from app.services.route_computation import execute_route_computation

task_queue: queue.Queue[dict[str, Any]] = queue.Queue()


def _worker_loop():
    """Single background worker thread that processes route computation tasks."""
    while True:
        task_data = task_queue.get()
        if task_data is None:
            break

        try:
            import asyncio
            loop = asyncio.new_event_loop()
            asyncio.set_event_loop(loop)
            loop.run_until_complete(
                execute_route_computation(
                    task_id=task_data["task_id"],
                    origin_lat=task_data["origin_lat"],
                    origin_lon=task_data["origin_lon"],
                    hospital_name=task_data["hospital_name"],
                    hospital_lat=task_data.get("hospital_lat"),
                    hospital_lon=task_data.get("hospital_lon"),
                )
            )
            loop.close()
        except Exception as e:
            from app.database import supabase
            supabase.table("route_tasks").update({
                "status": "failed",
                "error_message": str(e),
            }).eq("id", task_data["task_id"]).execute()

        task_queue.task_done()


class BackgroundWorkerThread:
    def __init__(self):
        self._thread = threading.Thread(target=_worker_loop, daemon=True)

    def start(self) -> threading.Thread:
        self._thread.start()
        return self._thread


background_worker_thread = BackgroundWorkerThread()
