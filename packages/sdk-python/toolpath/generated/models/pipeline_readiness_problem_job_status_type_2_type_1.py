from enum import Enum


class PipelineReadinessProblemJobStatusType2Type1(str, Enum):
    FAILED = "failed"
    QUEUED = "queued"
    RUNNING = "running"
    SUCCEEDED = "succeeded"

    def __str__(self) -> str:
        return str(self.value)
