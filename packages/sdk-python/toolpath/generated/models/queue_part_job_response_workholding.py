from enum import Enum


class QueuePartJobResponseWorkholding(str, Enum):
    SYNTHETICVISE = "syntheticVise"
    THINAIR = "thinAir"

    def __str__(self) -> str:
        return str(self.value)
