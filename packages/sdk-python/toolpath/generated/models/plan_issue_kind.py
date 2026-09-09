from enum import Enum


class PlanIssueKind(str, Enum):
    INCOMPLETE = "Incomplete"
    UNSEEN = "Unseen"

    def __str__(self) -> str:
        return str(self.value)
