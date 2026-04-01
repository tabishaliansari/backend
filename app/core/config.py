from pydantic_settings import BaseSettings, SettingsConfigDict

class Settings(BaseSettings):
    # Database Configuration
    DATABASE_URL: str

    # JWT Configuration
    SECRET_KEY: str

    # Application Configuration
    ENVIRONMENT: str = "development"  # development, testing, production
    DEBUG: bool = False

    model_config = SettingsConfigDict(
        env_file=".env",
        env_file_encoding="utf-8",
        case_sensitive=True,
        extra="ignore",
        validate_default=True
    )


settings = Settings()