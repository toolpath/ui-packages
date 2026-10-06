from enum import Enum


class FixedBoxStockPosition(str, Enum):
    MODELCENTERED = "modelCentered"
    OFFSETFROMBOTTOM = "offsetFromBottom"
    OFFSETFROMTOP = "offsetFromTop"

    def __str__(self) -> str:
        return str(self.value)
