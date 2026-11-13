from enum import Enum


class PartJobRequestWorkholding(str, Enum):
    SYNTHETICVISE = "syntheticVise"
    THINAIR = "thinAir"
    VACUUMTABLE = "vacuumTable"

    def __str__(self) -> str:
        return str(self.value)
