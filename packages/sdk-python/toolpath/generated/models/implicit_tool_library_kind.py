from enum import Enum


class ImplicitToolLibraryKind(str, Enum):
    IMPLICIT = "implicit"

    def __str__(self) -> str:
        return str(self.value)
