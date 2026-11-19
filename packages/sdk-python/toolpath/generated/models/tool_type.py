from enum import Enum


class ToolType(str, Enum):
    SOLID = "solid"

    def __str__(self) -> str:
        return str(self.value)
