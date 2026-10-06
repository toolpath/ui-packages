from enum import Enum


class FixedBoxStockMode(str, Enum):
    FIXEDBOX = "fixedBox"

    def __str__(self) -> str:
        return str(self.value)
