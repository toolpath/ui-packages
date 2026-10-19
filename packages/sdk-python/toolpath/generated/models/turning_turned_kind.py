from enum import Enum


class TurningTurnedKind(str, Enum):
    TURNED = "Turned"

    def __str__(self) -> str:
        return str(self.value)
