from pydantic_settings import BaseSettings, SettingsConfigDict

class Settings(BaseSettings):
    # Database Configuration
    DATABASE_URL: str

    # JWT Configuration - Access Token
    ACCESS_TOKEN_SECRET: str
    ACCESS_TOKEN_EXPIRE_MINUTES: int = 15

    # JWT Configuration - Refresh Token
    REFRESH_TOKEN_SECRET: str
    REFRESH_TOKEN_EXPIRE_DAYS: int = 7

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