from enum import Enum


class TurningBelowThresholdKind(str, Enum):
    BELOWTHRESHOLD = "BelowThreshold"

    def __str__(self) -> str:
        return str(self.value)
