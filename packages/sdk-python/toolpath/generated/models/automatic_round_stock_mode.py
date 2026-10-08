from enum import Enum


class AutomaticRoundStockMode(str, Enum):
    AUTOMATICROUNDSTOCK = "automaticRoundStock"

    def __str__(self) -> str:
        return str(self.value)
