from enum import Enum


class QueuePartJobResponseStatus(str, Enum):
    QUEUED = "queued"

    def __str__(self) -> str:
        return str(self.value)
