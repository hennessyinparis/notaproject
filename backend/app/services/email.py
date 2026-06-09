"""Email сервис для отправки писем.

В dev режиме логирует в консоль.
В production использует SMTP/SendGrid/Mailgun.
"""
import logging
from typing import Optional

from app.core.config import get_settings

logger = logging.getLogger(__name__)


class EmailService:
    """Сервис отправки email-уведомлений."""

    def __init__(self):
        self.settings = get_settings()
        self._smtp_configured = False
        self._init_smtp()

    def _init_smtp(self):
        """Проверяет настройки SMTP."""
        smtp_host = getattr(self.settings, "SMTP_HOST", None)
        if smtp_host:
            self._smtp_configured = True

    async def send_email(
        self,
        to_email: str,
        subject: str,
        html_body: str,
        text_body: Optional[str] = None,
    ) -> bool:
        """
        Отправляет email.

        В dev режиме логирует в консоль.
        В production использует SMTP.
        """
        is_dev = "localhost" in self.settings.BASE_URL or "127.0.0.1" in self.settings.BASE_URL

        if is_dev or not self._smtp_configured:
            logger.info(
                f"[DEV EMAIL] To: {to_email}\n"
                f"Subject: {subject}\n"
                f"Body: {html_body[:200]}..."
            )
            return True

        try:
            await self._send_smtp(to_email, subject, html_body, text_body)
            logger.info(f"Email sent to {to_email}: {subject}")
            return True
        except Exception as e:
            logger.error(f"Failed to send email to {to_email}: {e}")
            return False

    async def _send_smtp(self, to_email: str, subject: str, html_body: str, text_body: Optional[str] = None):
        """Отправка через SMTP."""
        import smtplib
        from email.mime.multipart import MIMEMultipart
        from email.mime.text import MIMEText

        msg = MIMEMultipart("alternative")
        msg["Subject"] = subject
        msg["From"] = getattr(self.settings, "SMTP_FROM", "noreply@nota.app")
        msg["To"] = to_email

        if text_body:
            msg.attach(MIMEText(text_body, "plain"))
        msg.attach(MIMEText(html_body, "html"))

        with smtplib.SMTP(
            getattr(self.settings, "SMTP_HOST", "localhost"),
            getattr(self.settings, "SMTP_PORT", 587),
        ) as server:
            server.starttls()
            server.login(
                getattr(self.settings, "SMTP_USER", ""),
                getattr(self.settings, "SMTP_PASSWORD", ""),
            )
            server.sendmail(
                getattr(self.settings, "SMTP_FROM", "noreply@nota.app"),
                [to_email],
                msg.as_string(),
            )

    async def send_password_reset(self, to_email: str, reset_link: str) -> bool:
        """Отправляет ссылку для сброса пароля."""
        subject = "Сброс пароля — Нота"
        html_body = f"""
        <html>
        <body style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto;">
            <h2>Сброс пароля</h2>
            <p>Вы запросили сброс пароля для вашего аккаунта на платформе <strong>Нота</strong>.</p>
            <p>Нажмите на кнопку ниже, чтобы установить новый пароль:</p>
            <p style="text-align: center;">
                <a href="{reset_link}" 
                   style="display: inline-block; padding: 12px 24px; background: #6C5CE7; 
                          color: white; text-decoration: none; border-radius: 8px;">
                    Сбросить пароль
                </a>
            </p>
            <p>Если вы не запрашивали сброс пароля, проигнорируйте это письмо.</p>
            <p>Ссылка действительна в течение 1 часа.</p>
            <hr>
            <p style="color: #666; font-size: 12px;">Платформа «Нота» — музыка для всех</p>
        </body>
        </html>
        """
        return await self.send_email(to_email, subject, html_body)

    async def send_welcome(self, to_email: str, username: str) -> bool:
        """Отправляет приветственное письмо."""
        subject = "Добро пожаловать в Ноту!"
        html_body = f"""
        <html>
        <body style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto;">
            <h2>Добро пожаловать, {username}! 🎵</h2>
            <p>Рады видеть вас на платформе <strong>Нота</strong>.</p>
            <p>Теперь вы можете:</p>
            <ul>
                <li>🎧 Слушать музыку без ограничений</li>
                <li>📤 Загружать свои треки</li>
                <li>👥 Подписываться на артистов</li>
                <li>💬 Общаться с другими музыкантами</li>
            </ul>
            <p>Создайте свой первый трек прямо сейчас!</p>
            <p style="text-align: center;">
                <a href="{self.settings.BASE_URL}/upload" 
                   style="display: inline-block; padding: 12px 24px; background: #6C5CE7; 
                          color: white; text-decoration: none; border-radius: 8px;">
                    Загрузить трек
                </a>
            </p>
            <hr>
            <p style="color: #666; font-size: 12px;">Платформа «Нота» — музыка для всех</p>
        </body>
        </html>
        """
        return await self.send_email(to_email, subject, html_body)


# Singleton instance
email_service = EmailService()
