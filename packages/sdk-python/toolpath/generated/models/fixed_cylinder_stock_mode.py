from enum import Enum


class FixedCylinderStockMode(str, Enum):
    FIXEDCYLINDER = "fixedCylinder"

    def __str__(self) -> str:
        return str(self.value)
