from enum import Enum


class PartJobRequestToolCribItemType0Kind(str, Enum):
    IMPLICIT = "implicit"

    def __str__(self) -> str:
        return str(self.value)
