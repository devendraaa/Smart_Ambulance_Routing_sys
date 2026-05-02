import queue
import threading
from typing import Any
from app.services.route_computation import execute_route_computation

task_queue: queue.Queue[dict[str, Any]] = queue.Queue()


def _publish_route_sensors_to_mqtt(task_id: str):
    """Fetch sensors near a completed route and publish to MQTT for IoT devices."""
    from app.database import supabase
    from app.services.mqtt_client import mqtt_client
    from app.routers.sensors import get_sensors_near_route_standalone

    try:
        # Use 0.05 km (50m) threshold so sensors near the route are captured
        sensors = get_sensors_near_route_standalone(task_id, threshold_km=0.05)
        if sensors:
            # Map 'id' -> 'sensor_id' for MQTT payload compatibility
            mapped = [
                {
                    "sensor_id": s.get("id"),
                    "latitude": s["latitude"],
                    "longitude": s["longitude"],
                    "distance_km": s.get("distance_km"),
                }
                for s in sensors
            ]
            print(f"[MQTT] Publishing {len(mapped)} sensors (threshold 50m) for task {task_id}")
            mqtt_client.publish_sensor_data(mapped)
            print(f"[MQTT] Published {len(mapped)} nearby sensors for task {task_id}")
        else:
            print(f"[MQTT] No sensors found near route for task {task_id}")
    except Exception as e:
        print(f"[MQTT] Failed to publish sensors for task {task_id}: {e}")


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

            # Publish nearby sensors to MQTT for IoT devices
            _publish_route_sensors_to_mqtt(task_data["task_id"])

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
