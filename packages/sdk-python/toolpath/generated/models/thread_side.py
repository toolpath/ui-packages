from enum import Enum


class ThreadSide(str, Enum):
    EXTERNAL = "External"
    INTERNAL = "Internal"

    def __str__(self) -> str:
        return str(self.value)
