from enum import Enum


class TurnedFeatureType(str, Enum):
    AXIALHOLE = "AxialHole"
    FACE = "Face"
    FACEGROOVE = "FaceGroove"
    FACEPROFILE = "FaceProfile"
    IDGROOVE = "IdGroove"
    IDPROFILE = "IdProfile"
    IDTHREAD = "IdThread"
    ODGROOVE = "OdGroove"
    ODPROFILE = "OdProfile"
    ODTHREAD = "OdThread"

    def __str__(self) -> str:
        return str(self.value)
