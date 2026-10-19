from enum import Enum


class PlanResponseWorkholding(str, Enum):
    SYNTHETICVISE = "syntheticVise"
    THINAIR = "thinAir"

    def __str__(self) -> str:
        return str(self.value)
