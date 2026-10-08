from enum import Enum


class ToolpathActionIntent(str, Enum):
    ADAPTIVEROUGH = "AdaptiveRough"
    COUNTERSINKSPIRAL = "CountersinkSpiral"
    DIRECTCOUNTERSINK = "DirectCountersink"
    FINISH = "Finish"
    FINISHFILLET = "FinishFillet"
    FINISHFLOOR = "FinishFloor"
    FINISHWALL = "FinishWall"
    ROUGH = "Rough"
    ROUGH3D = "Rough3d"
    ROUGHSLOT = "RoughSlot"
    SPOT = "Spot"
    THREAD = "Thread"
    TRADITIONALROUGH = "TraditionalRough"

    def __str__(self) -> str:
        return str(self.value)
