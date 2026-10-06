from enum import Enum


class FixedCylinderStockPosition(str, Enum):
    MODELCENTERED = "modelCentered"
    OFFSETFROMBOTTOM = "offsetFromBottom"
    OFFSETFROMTOP = "offsetFromTop"

    def __str__(self) -> str:
        return str(self.value)
