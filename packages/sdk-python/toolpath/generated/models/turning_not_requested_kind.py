from enum import Enum


class TurningNotRequestedKind(str, Enum):
    NOTREQUESTED = "NotRequested"

    def __str__(self) -> str:
        return str(self.value)
