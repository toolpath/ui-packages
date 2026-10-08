from enum import Enum


class AutomaticFlatBarStockMode(str, Enum):
    AUTOMATICFLATBAR = "automaticFlatBar"

    def __str__(self) -> str:
        return str(self.value)
