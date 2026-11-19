from enum import Enum


class InsertToolType(str, Enum):
    INSERT = "insert"

    def __str__(self) -> str:
        return str(self.value)
