from enum import Enum


class PlanIssueSummaryKind(str, Enum):
    INCOMPLETE = "Incomplete"
    OUTOFPLAY = "OutOfPlay"
    UNSEEN = "Unseen"

    def __str__(self) -> str:
        return str(self.value)
