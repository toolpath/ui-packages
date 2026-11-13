from enum import Enum


class FusionToolLibraryKind(str, Enum):
    FUSION = "fusion"

    def __str__(self) -> str:
        return str(self.value)
