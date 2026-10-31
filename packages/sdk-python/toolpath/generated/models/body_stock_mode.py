from enum import Enum


class BodyStockMode(str, Enum):
    BODY = "body"

    def __str__(self) -> str:
        return str(self.value)
