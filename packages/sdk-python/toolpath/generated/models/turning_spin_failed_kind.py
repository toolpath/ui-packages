from enum import Enum


class TurningSpinFailedKind(str, Enum):
    SPINFAILED = "SpinFailed"

    def __str__(self) -> str:
        return str(self.value)
