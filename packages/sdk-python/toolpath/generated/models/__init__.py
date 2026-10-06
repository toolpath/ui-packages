"""Contains all the data models used in inputs/outputs"""

from .automatic_flat_bar_stock import AutomaticFlatBarStock
from .automatic_flat_bar_stock_mode import AutomaticFlatBarStockMode
from .automatic_round_stock import AutomaticRoundStock
from .automatic_round_stock_mode import AutomaticRoundStockMode
from .bevel_facts import BevelFacts
from .boss_facts import BossFacts
from .bullnose_curve import BullnoseCurve
from .cd_bounds import CdBounds
from .cd_data import CdData
from .chamfer_facts import ChamferFacts
from .cone import Cone
from .create_holder_response import CreateHolderResponse
from .create_part_response import CreatePartResponse
from .demo_session_request import DemoSessionRequest
from .demo_session_response import DemoSessionResponse
from .direction_z_bounds import DirectionZBounds
from .direction_z_bounds_direction import DirectionZBoundsDirection
from .dovetail_facts import DovetailFacts
from .download_holder_fusion_format import DownloadHolderFusionFormat
from .download_holder_fusion_trim import DownloadHolderFusionTrim
from .export_fusion_holder_library_trim import ExportFusionHolderLibraryTrim
from .face_facts import FaceFacts
from .feature_datasheet import FeatureDatasheet
from .feature_type import FeatureType
from .feed_speed import FeedSpeed
from .fixed_box_stock import FixedBoxStock
from .fixed_box_stock_dimensions import FixedBoxStockDimensions
from .fixed_box_stock_mode import FixedBoxStockMode
from .fixed_box_stock_position import FixedBoxStockPosition
from .fixed_cylinder_stock import FixedCylinderStock
from .fixed_cylinder_stock_mode import FixedCylinderStockMode
from .fixed_cylinder_stock_position import FixedCylinderStockPosition
from .health_response import HealthResponse
from .health_response_db import HealthResponseDb
from .health_response_status import HealthResponseStatus
from .holder_response import HolderResponse
from .holder_response_axis_direction import HolderResponseAxisDirection
from .holder_response_axis_location import HolderResponseAxisLocation
from .holder_response_nose import HolderResponseNose
from .holder_response_options import HolderResponseOptions
from .holder_response_taper_family_type_1 import HolderResponseTaperFamilyType1
from .holder_response_taper_family_type_2_type_1 import HolderResponseTaperFamilyType2Type1
from .holder_response_taper_family_type_3_type_1 import HolderResponseTaperFamilyType3Type1
from .holder_response_units import HolderResponseUnits
from .holder_units import HolderUnits
from .holder_units_angle import HolderUnitsAngle
from .holder_units_length import HolderUnitsLength
from .holder_vec_3 import HolderVec3
from .hole_facts import HoleFacts
from .hole_process import HoleProcess
from .job_detail import JobDetail
from .job_detail_status import JobDetailStatus
from .job_summary import JobSummary
from .job_summary_status import JobSummaryStatus
from .key_validation_response import KeyValidationResponse
from .key_validation_response_status import KeyValidationResponseStatus
from .list_jobs_response import ListJobsResponse
from .list_jobs_status import ListJobsStatus
from .machining_time_action import MachiningTimeAction
from .machining_time_action_intent import MachiningTimeActionIntent
from .machining_time_response import MachiningTimeResponse
from .machining_time_response_stock import MachiningTimeResponseStock
from .machining_time_setup import MachiningTimeSetup
from .no_axis import NoAxis
from .no_axis_kind import NoAxisKind
from .offset_length import OffsetLength
from .open_api_document import OpenApiDocument
from .part_feature import PartFeature
from .part_feature_axis import PartFeatureAxis
from .part_feature_entry import PartFeatureEntry
from .part_feature_machining_direction import PartFeatureMachiningDirection
from .part_features_response import PartFeaturesResponse
from .part_job_request import PartJobRequest
from .part_job_request_done_regions_type_0 import PartJobRequestDoneRegionsType0
from .part_job_request_machine import PartJobRequestMachine
from .part_job_request_material import PartJobRequestMaterial
from .part_job_request_setup_plan_type_0 import PartJobRequestSetupPlanType0
from .part_job_request_setup_plan_type_0_setups_item import PartJobRequestSetupPlanType0SetupsItem
from .part_job_request_setup_plan_type_0_setups_item_orientations_item import (
    PartJobRequestSetupPlanType0SetupsItemOrientationsItem,
)
from .part_job_request_setup_plan_type_0_setups_item_orientations_item_direction import (
    PartJobRequestSetupPlanType0SetupsItemOrientationsItemDirection,
)
from .part_job_request_tool_crib_item_type_0 import PartJobRequestToolCribItemType0
from .part_job_request_tool_crib_item_type_0_ball_endmill import PartJobRequestToolCribItemType0BallEndmill
from .part_job_request_tool_crib_item_type_0_ball_endmill_inch import PartJobRequestToolCribItemType0BallEndmillInch
from .part_job_request_tool_crib_item_type_0_ball_endmill_metric import PartJobRequestToolCribItemType0BallEndmillMetric
from .part_job_request_tool_crib_item_type_0_bull_nose import PartJobRequestToolCribItemType0BullNose
from .part_job_request_tool_crib_item_type_0_bull_nose_inch import PartJobRequestToolCribItemType0BullNoseInch
from .part_job_request_tool_crib_item_type_0_bull_nose_metric import PartJobRequestToolCribItemType0BullNoseMetric
from .part_job_request_tool_crib_item_type_0_chamfer import PartJobRequestToolCribItemType0Chamfer
from .part_job_request_tool_crib_item_type_0_chamfer_inch import PartJobRequestToolCribItemType0ChamferInch
from .part_job_request_tool_crib_item_type_0_chamfer_metric import PartJobRequestToolCribItemType0ChamferMetric
from .part_job_request_tool_crib_item_type_0_corner_rounding import PartJobRequestToolCribItemType0CornerRounding
from .part_job_request_tool_crib_item_type_0_corner_rounding_inch import (
    PartJobRequestToolCribItemType0CornerRoundingInch,
)
from .part_job_request_tool_crib_item_type_0_corner_rounding_metric import (
    PartJobRequestToolCribItemType0CornerRoundingMetric,
)
from .part_job_request_tool_crib_item_type_0_drill import PartJobRequestToolCribItemType0Drill
from .part_job_request_tool_crib_item_type_0_drill_inch import PartJobRequestToolCribItemType0DrillInch
from .part_job_request_tool_crib_item_type_0_drill_metric import PartJobRequestToolCribItemType0DrillMetric
from .part_job_request_tool_crib_item_type_0_face_mill import PartJobRequestToolCribItemType0FaceMill
from .part_job_request_tool_crib_item_type_0_face_mill_inch import PartJobRequestToolCribItemType0FaceMillInch
from .part_job_request_tool_crib_item_type_0_face_mill_metric import PartJobRequestToolCribItemType0FaceMillMetric
from .part_job_request_tool_crib_item_type_0_flat_endmill import PartJobRequestToolCribItemType0FlatEndmill
from .part_job_request_tool_crib_item_type_0_flat_endmill_inch import PartJobRequestToolCribItemType0FlatEndmillInch
from .part_job_request_tool_crib_item_type_0_flat_endmill_metric import PartJobRequestToolCribItemType0FlatEndmillMetric
from .part_job_request_tool_crib_item_type_0_keyseat import PartJobRequestToolCribItemType0Keyseat
from .part_job_request_tool_crib_item_type_0_keyseat_inch import PartJobRequestToolCribItemType0KeyseatInch
from .part_job_request_tool_crib_item_type_0_keyseat_metric import PartJobRequestToolCribItemType0KeyseatMetric
from .part_job_request_tool_crib_item_type_0_kind import PartJobRequestToolCribItemType0Kind
from .part_job_request_tool_crib_item_type_0_tap import PartJobRequestToolCribItemType0Tap
from .part_job_request_tool_crib_item_type_0_tap_inch import PartJobRequestToolCribItemType0TapInch
from .part_job_request_tool_crib_item_type_0_tap_metric import PartJobRequestToolCribItemType0TapMetric
from .part_mesh_job_response import PartMeshJobResponse
from .part_mesh_job_response_status import PartMeshJobResponseStatus
from .part_mesh_response import PartMeshResponse
from .part_response import PartResponse
from .part_response_units import PartResponseUnits
from .pinch_point import PinchPoint
from .pipeline_readiness_problem import PipelineReadinessProblem
from .pipeline_readiness_problem_job_status_type_1 import PipelineReadinessProblemJobStatusType1
from .pipeline_readiness_problem_job_status_type_2_type_1 import PipelineReadinessProblemJobStatusType2Type1
from .pipeline_readiness_problem_job_status_type_3_type_1 import PipelineReadinessProblemJobStatusType3Type1
from .pipeline_readiness_problem_required_step import PipelineReadinessProblemRequiredStep
from .plan_action import PlanAction
from .plan_action_intent import PlanActionIntent
from .plan_action_tool_type_0 import PlanActionToolType0
from .plan_issue import PlanIssue
from .plan_issue_kind import PlanIssueKind
from .plan_list_response import PlanListResponse
from .plan_response import PlanResponse
from .plan_response_done_regions_type_0 import PlanResponseDoneRegionsType0
from .plan_response_level import PlanResponseLevel
from .plan_response_material import PlanResponseMaterial
from .plan_response_setup_plan_type_0 import PlanResponseSetupPlanType0
from .plan_response_setup_plan_type_0_setups_item import PlanResponseSetupPlanType0SetupsItem
from .plan_response_setup_plan_type_0_setups_item_orientations_item import (
    PlanResponseSetupPlanType0SetupsItemOrientationsItem,
)
from .plan_response_setup_plan_type_0_setups_item_orientations_item_direction import (
    PlanResponseSetupPlanType0SetupsItemOrientationsItemDirection,
)
from .plan_response_stock import PlanResponseStock
from .plan_setup import PlanSetup
from .plan_summary import PlanSummary
from .plan_summary_level import PlanSummaryLevel
from .plan_summary_material import PlanSummaryMaterial
from .pocket_facts import PocketFacts
from .problem_details import ProblemDetails
from .profile_facts import ProfileFacts
from .queue_part_job_response import QueuePartJobResponse
from .queue_part_job_response_done_regions_type_0 import QueuePartJobResponseDoneRegionsType0
from .queue_part_job_response_machine_type_0 import QueuePartJobResponseMachineType0
from .queue_part_job_response_material import QueuePartJobResponseMaterial
from .queue_part_job_response_setup_plan_type_0 import QueuePartJobResponseSetupPlanType0
from .queue_part_job_response_setup_plan_type_0_setups_item import QueuePartJobResponseSetupPlanType0SetupsItem
from .queue_part_job_response_setup_plan_type_0_setups_item_orientations_item import (
    QueuePartJobResponseSetupPlanType0SetupsItemOrientationsItem,
)
from .queue_part_job_response_setup_plan_type_0_setups_item_orientations_item_direction import (
    QueuePartJobResponseSetupPlanType0SetupsItemOrientationsItemDirection,
)
from .queue_part_job_response_status import QueuePartJobResponseStatus
from .queue_part_job_response_stock import QueuePartJobResponseStock
from .queue_part_job_response_tool_crib_item_type_0 import QueuePartJobResponseToolCribItemType0
from .queue_part_job_response_tool_crib_item_type_0_ball_endmill import QueuePartJobResponseToolCribItemType0BallEndmill
from .queue_part_job_response_tool_crib_item_type_0_ball_endmill_inch import (
    QueuePartJobResponseToolCribItemType0BallEndmillInch,
)
from .queue_part_job_response_tool_crib_item_type_0_ball_endmill_metric import (
    QueuePartJobResponseToolCribItemType0BallEndmillMetric,
)
from .queue_part_job_response_tool_crib_item_type_0_bull_nose import QueuePartJobResponseToolCribItemType0BullNose
from .queue_part_job_response_tool_crib_item_type_0_bull_nose_inch import (
    QueuePartJobResponseToolCribItemType0BullNoseInch,
)
from .queue_part_job_response_tool_crib_item_type_0_bull_nose_metric import (
    QueuePartJobResponseToolCribItemType0BullNoseMetric,
)
from .queue_part_job_response_tool_crib_item_type_0_chamfer import QueuePartJobResponseToolCribItemType0Chamfer
from .queue_part_job_response_tool_crib_item_type_0_chamfer_inch import QueuePartJobResponseToolCribItemType0ChamferInch
from .queue_part_job_response_tool_crib_item_type_0_chamfer_metric import (
    QueuePartJobResponseToolCribItemType0ChamferMetric,
)
from .queue_part_job_response_tool_crib_item_type_0_corner_rounding import (
    QueuePartJobResponseToolCribItemType0CornerRounding,
)
from .queue_part_job_response_tool_crib_item_type_0_corner_rounding_inch import (
    QueuePartJobResponseToolCribItemType0CornerRoundingInch,
)
from .queue_part_job_response_tool_crib_item_type_0_corner_rounding_metric import (
    QueuePartJobResponseToolCribItemType0CornerRoundingMetric,
)
from .queue_part_job_response_tool_crib_item_type_0_drill import QueuePartJobResponseToolCribItemType0Drill
from .queue_part_job_response_tool_crib_item_type_0_drill_inch import QueuePartJobResponseToolCribItemType0DrillInch
from .queue_part_job_response_tool_crib_item_type_0_drill_metric import QueuePartJobResponseToolCribItemType0DrillMetric
from .queue_part_job_response_tool_crib_item_type_0_face_mill import QueuePartJobResponseToolCribItemType0FaceMill
from .queue_part_job_response_tool_crib_item_type_0_face_mill_inch import (
    QueuePartJobResponseToolCribItemType0FaceMillInch,
)
from .queue_part_job_response_tool_crib_item_type_0_face_mill_metric import (
    QueuePartJobResponseToolCribItemType0FaceMillMetric,
)
from .queue_part_job_response_tool_crib_item_type_0_flat_endmill import QueuePartJobResponseToolCribItemType0FlatEndmill
from .queue_part_job_response_tool_crib_item_type_0_flat_endmill_inch import (
    QueuePartJobResponseToolCribItemType0FlatEndmillInch,
)
from .queue_part_job_response_tool_crib_item_type_0_flat_endmill_metric import (
    QueuePartJobResponseToolCribItemType0FlatEndmillMetric,
)
from .queue_part_job_response_tool_crib_item_type_0_keyseat import QueuePartJobResponseToolCribItemType0Keyseat
from .queue_part_job_response_tool_crib_item_type_0_keyseat_inch import QueuePartJobResponseToolCribItemType0KeyseatInch
from .queue_part_job_response_tool_crib_item_type_0_keyseat_metric import (
    QueuePartJobResponseToolCribItemType0KeyseatMetric,
)
from .queue_part_job_response_tool_crib_item_type_0_kind import QueuePartJobResponseToolCribItemType0Kind
from .queue_part_job_response_tool_crib_item_type_0_tap import QueuePartJobResponseToolCribItemType0Tap
from .queue_part_job_response_tool_crib_item_type_0_tap_inch import QueuePartJobResponseToolCribItemType0TapInch
from .queue_part_job_response_tool_crib_item_type_0_tap_metric import QueuePartJobResponseToolCribItemType0TapMetric
from .reach_curve import ReachCurve
from .region import Region
from .report_units import ReportUnits
from .report_units_angle import ReportUnitsAngle
from .report_units_length import ReportUnitsLength
from .sink_facts import SinkFacts
from .stock_box import StockBox
from .stock_box_frame import StockBoxFrame
from .stock_box_frame_axis import StockBoxFrameAxis
from .stock_box_frame_location import StockBoxFrameLocation
from .stock_box_frame_ref_direction import StockBoxFrameRefDirection
from .stock_box_lower import StockBoxLower
from .stock_box_shape import StockBoxShape
from .stock_box_upper import StockBoxUpper
from .stock_cylinder import StockCylinder
from .stock_cylinder_axis import StockCylinderAxis
from .stock_cylinder_origin import StockCylinderOrigin
from .stock_cylinder_shape import StockCylinderShape
from .surface_areas import SurfaceAreas
from .surface_facts import SurfaceFacts
from .thread_handedness import ThreadHandedness
from .thread_process import ThreadProcess
from .thread_spec import ThreadSpec
from .threading import Threading
from .tolerance_band import ToleranceBand
from .tool_fit_result import ToolFitResult
from .toolpath_action import ToolpathAction
from .toolpath_action_intent import ToolpathActionIntent
from .toolpath_setup import ToolpathSetup
from .toolpaths_response import ToolpathsResponse
from .tslot_facts import TslotFacts
from .turning_axis import TurningAxis
from .turning_axis_direction import TurningAxisDirection
from .turning_axis_kind import TurningAxisKind
from .turning_axis_location import TurningAxisLocation
from .update_holder_fill_bays import UpdateHolderFillBays
from .update_holder_flipped import UpdateHolderFlipped
from .update_holder_response import UpdateHolderResponse
from .update_holder_response_status import UpdateHolderResponseStatus
from .update_part_feature_details import UpdatePartFeatureDetails
from .update_part_features_request import UpdatePartFeaturesRequest
from .update_part_features_response import UpdatePartFeaturesResponse
from .update_part_features_response_status import UpdatePartFeaturesResponseStatus
from .update_part_response import UpdatePartResponse
from .update_part_response_status import UpdatePartResponseStatus
from .vec_2 import Vec2
from .vec_3 import Vec3
from .wall_facts import WallFacts

__all__ = (
    "AutomaticFlatBarStock",
    "AutomaticFlatBarStockMode",
    "AutomaticRoundStock",
    "AutomaticRoundStockMode",
    "BevelFacts",
    "BossFacts",
    "BullnoseCurve",
    "CdBounds",
    "CdData",
    "ChamferFacts",
    "Cone",
    "CreateHolderResponse",
    "CreatePartResponse",
    "DemoSessionRequest",
    "DemoSessionResponse",
    "DirectionZBounds",
    "DirectionZBoundsDirection",
    "DovetailFacts",
    "DownloadHolderFusionFormat",
    "DownloadHolderFusionTrim",
    "ExportFusionHolderLibraryTrim",
    "FaceFacts",
    "FeatureDatasheet",
    "FeatureType",
    "FeedSpeed",
    "FixedBoxStock",
    "FixedBoxStockDimensions",
    "FixedBoxStockMode",
    "FixedBoxStockPosition",
    "FixedCylinderStock",
    "FixedCylinderStockMode",
    "FixedCylinderStockPosition",
    "HealthResponse",
    "HealthResponseDb",
    "HealthResponseStatus",
    "HolderResponse",
    "HolderResponseAxisDirection",
    "HolderResponseAxisLocation",
    "HolderResponseNose",
    "HolderResponseOptions",
    "HolderResponseTaperFamilyType1",
    "HolderResponseTaperFamilyType2Type1",
    "HolderResponseTaperFamilyType3Type1",
    "HolderResponseUnits",
    "HolderUnits",
    "HolderUnitsAngle",
    "HolderUnitsLength",
    "HolderVec3",
    "HoleFacts",
    "HoleProcess",
    "JobDetail",
    "JobDetailStatus",
    "JobSummary",
    "JobSummaryStatus",
    "KeyValidationResponse",
    "KeyValidationResponseStatus",
    "ListJobsResponse",
    "ListJobsStatus",
    "MachiningTimeAction",
    "MachiningTimeActionIntent",
    "MachiningTimeResponse",
    "MachiningTimeResponseStock",
    "MachiningTimeSetup",
    "NoAxis",
    "NoAxisKind",
    "OffsetLength",
    "OpenApiDocument",
    "PartFeature",
    "PartFeatureAxis",
    "PartFeatureEntry",
    "PartFeatureMachiningDirection",
    "PartFeaturesResponse",
    "PartJobRequest",
    "PartJobRequestDoneRegionsType0",
    "PartJobRequestMachine",
    "PartJobRequestMaterial",
    "PartJobRequestSetupPlanType0",
    "PartJobRequestSetupPlanType0SetupsItem",
    "PartJobRequestSetupPlanType0SetupsItemOrientationsItem",
    "PartJobRequestSetupPlanType0SetupsItemOrientationsItemDirection",
    "PartJobRequestToolCribItemType0",
    "PartJobRequestToolCribItemType0BallEndmill",
    "PartJobRequestToolCribItemType0BallEndmillInch",
    "PartJobRequestToolCribItemType0BallEndmillMetric",
    "PartJobRequestToolCribItemType0BullNose",
    "PartJobRequestToolCribItemType0BullNoseInch",
    "PartJobRequestToolCribItemType0BullNoseMetric",
    "PartJobRequestToolCribItemType0Chamfer",
    "PartJobRequestToolCribItemType0ChamferInch",
    "PartJobRequestToolCribItemType0ChamferMetric",
    "PartJobRequestToolCribItemType0CornerRounding",
    "PartJobRequestToolCribItemType0CornerRoundingInch",
    "PartJobRequestToolCribItemType0CornerRoundingMetric",
    "PartJobRequestToolCribItemType0Drill",
    "PartJobRequestToolCribItemType0DrillInch",
    "PartJobRequestToolCribItemType0DrillMetric",
    "PartJobRequestToolCribItemType0FaceMill",
    "PartJobRequestToolCribItemType0FaceMillInch",
    "PartJobRequestToolCribItemType0FaceMillMetric",
    "PartJobRequestToolCribItemType0FlatEndmill",
    "PartJobRequestToolCribItemType0FlatEndmillInch",
    "PartJobRequestToolCribItemType0FlatEndmillMetric",
    "PartJobRequestToolCribItemType0Keyseat",
    "PartJobRequestToolCribItemType0KeyseatInch",
    "PartJobRequestToolCribItemType0KeyseatMetric",
    "PartJobRequestToolCribItemType0Kind",
    "PartJobRequestToolCribItemType0Tap",
    "PartJobRequestToolCribItemType0TapInch",
    "PartJobRequestToolCribItemType0TapMetric",
    "PartMeshJobResponse",
    "PartMeshJobResponseStatus",
    "PartMeshResponse",
    "PartResponse",
    "PartResponseUnits",
    "PinchPoint",
    "PipelineReadinessProblem",
    "PipelineReadinessProblemJobStatusType1",
    "PipelineReadinessProblemJobStatusType2Type1",
    "PipelineReadinessProblemJobStatusType3Type1",
    "PipelineReadinessProblemRequiredStep",
    "PlanAction",
    "PlanActionIntent",
    "PlanActionToolType0",
    "PlanIssue",
    "PlanIssueKind",
    "PlanListResponse",
    "PlanResponse",
    "PlanResponseDoneRegionsType0",
    "PlanResponseLevel",
    "PlanResponseMaterial",
    "PlanResponseSetupPlanType0",
    "PlanResponseSetupPlanType0SetupsItem",
    "PlanResponseSetupPlanType0SetupsItemOrientationsItem",
    "PlanResponseSetupPlanType0SetupsItemOrientationsItemDirection",
    "PlanResponseStock",
    "PlanSetup",
    "PlanSummary",
    "PlanSummaryLevel",
    "PlanSummaryMaterial",
    "PocketFacts",
    "ProblemDetails",
    "ProfileFacts",
    "QueuePartJobResponse",
    "QueuePartJobResponseDoneRegionsType0",
    "QueuePartJobResponseMachineType0",
    "QueuePartJobResponseMaterial",
    "QueuePartJobResponseSetupPlanType0",
    "QueuePartJobResponseSetupPlanType0SetupsItem",
    "QueuePartJobResponseSetupPlanType0SetupsItemOrientationsItem",
    "QueuePartJobResponseSetupPlanType0SetupsItemOrientationsItemDirection",
    "QueuePartJobResponseStatus",
    "QueuePartJobResponseStock",
    "QueuePartJobResponseToolCribItemType0",
    "QueuePartJobResponseToolCribItemType0BallEndmill",
    "QueuePartJobResponseToolCribItemType0BallEndmillInch",
    "QueuePartJobResponseToolCribItemType0BallEndmillMetric",
    "QueuePartJobResponseToolCribItemType0BullNose",
    "QueuePartJobResponseToolCribItemType0BullNoseInch",
    "QueuePartJobResponseToolCribItemType0BullNoseMetric",
    "QueuePartJobResponseToolCribItemType0Chamfer",
    "QueuePartJobResponseToolCribItemType0ChamferInch",
    "QueuePartJobResponseToolCribItemType0ChamferMetric",
    "QueuePartJobResponseToolCribItemType0CornerRounding",
    "QueuePartJobResponseToolCribItemType0CornerRoundingInch",
    "QueuePartJobResponseToolCribItemType0CornerRoundingMetric",
    "QueuePartJobResponseToolCribItemType0Drill",
    "QueuePartJobResponseToolCribItemType0DrillInch",
    "QueuePartJobResponseToolCribItemType0DrillMetric",
    "QueuePartJobResponseToolCribItemType0FaceMill",
    "QueuePartJobResponseToolCribItemType0FaceMillInch",
    "QueuePartJobResponseToolCribItemType0FaceMillMetric",
    "QueuePartJobResponseToolCribItemType0FlatEndmill",
    "QueuePartJobResponseToolCribItemType0FlatEndmillInch",
    "QueuePartJobResponseToolCribItemType0FlatEndmillMetric",
    "QueuePartJobResponseToolCribItemType0Keyseat",
    "QueuePartJobResponseToolCribItemType0KeyseatInch",
    "QueuePartJobResponseToolCribItemType0KeyseatMetric",
    "QueuePartJobResponseToolCribItemType0Kind",
    "QueuePartJobResponseToolCribItemType0Tap",
    "QueuePartJobResponseToolCribItemType0TapInch",
    "QueuePartJobResponseToolCribItemType0TapMetric",
    "ReachCurve",
    "Region",
    "ReportUnits",
    "ReportUnitsAngle",
    "ReportUnitsLength",
    "SinkFacts",
    "StockBox",
    "StockBoxFrame",
    "StockBoxFrameAxis",
    "StockBoxFrameLocation",
    "StockBoxFrameRefDirection",
    "StockBoxLower",
    "StockBoxShape",
    "StockBoxUpper",
    "StockCylinder",
    "StockCylinderAxis",
    "StockCylinderOrigin",
    "StockCylinderShape",
    "SurfaceAreas",
    "SurfaceFacts",
    "ThreadHandedness",
    "Threading",
    "ThreadProcess",
    "ThreadSpec",
    "ToleranceBand",
    "ToolFitResult",
    "ToolpathAction",
    "ToolpathActionIntent",
    "ToolpathSetup",
    "ToolpathsResponse",
    "TslotFacts",
    "TurningAxis",
    "TurningAxisDirection",
    "TurningAxisKind",
    "TurningAxisLocation",
    "UpdateHolderFillBays",
    "UpdateHolderFlipped",
    "UpdateHolderResponse",
    "UpdateHolderResponseStatus",
    "UpdatePartFeatureDetails",
    "UpdatePartFeaturesRequest",
    "UpdatePartFeaturesResponse",
    "UpdatePartFeaturesResponseStatus",
    "UpdatePartResponse",
    "UpdatePartResponseStatus",
    "Vec2",
    "Vec3",
    "WallFacts",
)
