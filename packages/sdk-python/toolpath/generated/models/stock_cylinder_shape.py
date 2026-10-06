from enum import Enum


class StockCylinderShape(str, Enum):
    CYLINDER = "cylinder"

    def __str__(self) -> str:
        return str(self.value)
