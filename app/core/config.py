from pydantic_settings import BaseSettings, SettingsConfigDict

class Settings(BaseSettings):
    # Database Configuration
    DATABASE_URL: str

    # JWT Configuration - Access Token
    ACCESS_TOKEN_SECRET: str
    ACCESS_TOKEN_EXPIRE_HOURS: int = 15

    # JWT Configuration - Refresh Token
    REFRESH_TOKEN_SECRET: str
    REFRESH_TOKEN_EXPIRE_DAYS: int = 7

    # Application Configuration
    ENVIRONMENT: str = "development"  # development, testing, production
    DEBUG: bool = False
    BASE_URL: str = "http://localhost:8000"
    CLIENT_URL: str = "http://localhost:5173"

    # Email Configuration (SMTP)
    MAILTRAP_SMTP_HOST: str = "smtp.mailtrap.io"
    MAILTRAP_SMTP_PORT: int = 2525
    MAILTRAP_SMTP_USER: str = ""
    MAILTRAP_SMTP_PASS: str = ""
    MAILTRAP_SENDEREMAIL: str = "noreply@example.com"
    MAIL_FROM_NAME: str = "GraphLM Team"

    # Cloudinary Configuration
    CLOUDINARY_CLOUD_NAME: str = ""
    CLOUDINARY_API_KEY: str = ""
    CLOUDINARY_API_SECRET: str = ""

    # GitHub OAuth Configuration
    GITHUB_CLIENT_ID: str = ""
    GITHUB_CLIENT_SECRET: str = ""
    GITHUB_REDIRECT_URI: str = ""

    # File Upload Configuration
    MAX_AVATAR_FILE_SIZE: int = 1_048_576  # 1MB in bytes
    ALLOWED_IMAGE_TYPES: list = ["image/jpeg", "image/png", "image/webp", "image/gif"]

    model_config = SettingsConfigDict(
        env_file=".env",
        env_file_encoding="utf-8",
        case_sensitive=True,
        extra="ignore",
        validate_default=True
    )


settings = Settings()