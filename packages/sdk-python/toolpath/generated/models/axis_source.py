from enum import Enum


class AxisSource(str, Enum):
    DETECTED = "Detected"
    USERGIVEN = "UserGiven"

    def __str__(self) -> str:
        return str(self.value)
