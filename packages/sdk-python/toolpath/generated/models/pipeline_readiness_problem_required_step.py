from enum import Enum


class PipelineReadinessProblemRequiredStep(str, Enum):
    CALCULATE_TOOLPATHS = "calculate-toolpaths"
    PLAN_PART = "plan-part"

    def __str__(self) -> str:
        return str(self.value)
