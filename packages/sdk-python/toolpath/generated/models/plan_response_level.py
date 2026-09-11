from enum import Enum


class PlanResponseLevel(str, Enum):
    PLANNED = "planned"
    TOOLPATHED = "toolpathed"

    def __str__(self) -> str:
        return str(self.value)
