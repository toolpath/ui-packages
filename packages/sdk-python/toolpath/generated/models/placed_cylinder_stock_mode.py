from enum import Enum


class PlacedCylinderStockMode(str, Enum):
    PLACEDCYLINDER = "placedCylinder"

    def __str__(self) -> str:
        return str(self.value)
