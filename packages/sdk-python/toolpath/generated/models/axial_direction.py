from enum import Enum


class AxialDirection(str, Enum):
    MINUSZ = "MinusZ"
    PLUSZ = "PlusZ"

    def __str__(self) -> str:
        return str(self.value)
