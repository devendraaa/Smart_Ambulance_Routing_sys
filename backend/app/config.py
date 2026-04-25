from pydantic_settings import BaseSettings


class Settings(BaseSettings):
    SUPABASE_URL: str = "https://your-project.supabase.co"
    SUPABASE_KEY: str = "your-service-role-key"
    MQTT_BROKER_HOST: str = "broker.hivemq.com"
    MQTT_PORT: int = 1883
    CLOUDINARY_CLOUD_NAME: str = ""
    CLOUDINARY_API_KEY: str = ""
    CLOUDINARY_API_SECRET: str = ""
    CORS_ORIGINS: list[str] = ["http://localhost:3000"]
    ORS_API_KEY: str = ""

    model_config = {"env_file": ".env", "extra": "ignore"}


settings = Settings()
