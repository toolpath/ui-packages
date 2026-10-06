from enum import Enum


class QueuePartJobResponseMaterial(str, Enum):
    ALUMINUM = "Aluminum"
    LOWCARBONSTEEL = "LowCarbonSteel"
    STAINLESSSTEEL = "StainlessSteel"

    def __str__(self) -> str:
        return str(self.value)
