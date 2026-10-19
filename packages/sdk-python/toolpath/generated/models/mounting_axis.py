from enum import Enum


class MountingAxis(str, Enum):
    AXIAL = "Axial"
    RADIAL = "Radial"

    def __str__(self) -> str:
        return str(self.value)
