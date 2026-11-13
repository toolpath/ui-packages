from enum import Enum


class PlacedBoxStockMode(str, Enum):
    PLACEDBOX = "placedBox"

    def __str__(self) -> str:
        return str(self.value)
