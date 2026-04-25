import folium
import cloudinary
import cloudinary.uploader
import io
from app.config import settings

cloudinary.config(
    cloud_name=settings.CLOUDINARY_CLOUD_NAME,
    api_key=settings.CLOUDINARY_API_KEY,
    api_secret=settings.CLOUDINARY_API_SECRET,
)


def generate_route_map(
    route_coordinates: list[tuple[float, float]],
    sensor_coordinates: list[tuple[float, float]],
    center: tuple[float, float] = (19.045823, 72.848379),
    zoom: int = 15,
) -> str:
    """Generate Folium map HTML with route and sensor markers."""
    m = folium.Map(location=center, zoom_start=zoom)

    for lat, lon in route_coordinates:
        folium.Marker([lat, lon], popup=[lat, lon]).add_to(m)

    for lat, lon in sensor_coordinates:
        folium.Marker(
            [lat, lon],
            popup=f"Sensor ({lat}, {lon})",
            icon=folium.Icon(color="green"),
        ).add_to(m)

    return m._repr_html_()


def upload_map_to_cloudinary(html: str, task_id: str) -> str:
    """Upload Folium HTML string to Cloudinary. Returns public URL."""
    html_bytes = html.encode("utf-8")

    result = cloudinary.uploader.upload(
        io.BytesIO(html_bytes),
        resource_type="raw",
        public_id=f"maps/route_{task_id}",
        format="html",
    )
    return result["secure_url"]
