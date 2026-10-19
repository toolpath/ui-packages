from enum import Enum


class TurningNoAxisKind(str, Enum):
    NOAXIS = "NoAxis"

    def __str__(self) -> str:
        return str(self.value)
