from __future__ import annotations

from collections.abc import Mapping
from typing import TYPE_CHECKING, Any, TypeVar, cast
from uuid import UUID

from attrs import define as _attrs_define
from attrs import field as _attrs_field

from ..types import UNSET, Unset

if TYPE_CHECKING:
    from ..models.direction_z_bounds import DirectionZBounds
    from ..models.no_axis import NoAxis
    from ..models.part_feature import PartFeature
    from ..models.region import Region
    from ..models.report_units import ReportUnits
    from ..models.turning_axis import TurningAxis
    from ..models.turning_below_threshold import TurningBelowThreshold
    from ..models.turning_no_axis import TurningNoAxis
    from ..models.turning_not_requested import TurningNotRequested
    from ..models.turning_spin_failed import TurningSpinFailed
    from ..models.turning_turned import TurningTurned
    from ..models.vec_3 import Vec3


T = TypeVar("T", bound="PartResponse")


@_attrs_define
class PartResponse:
    """
    Attributes:
        part_id (UUID): Identifier of this part.
        report_id (UUID): Identifier of this immutable part result.
        job_id (UUID): Identifier of the processing job that produced this part result.
        kernel_version (str): Version of the Toolpath kernel that produced this part result.
        units (ReportUnits):
        regions (list[Region]): Recognized B-rep regions, ordered by region index.
        features (list[PartFeature]): Features recognized during this processing run.
        candidate_directions (list[Vec3]): Directions the part was analyzed from, and so the ones its features and a
            `setupPlan` can name: those the directions analysis chose, best first, then the added directions it could
            analyze the part from, in the order added.
        discovered_directions (list[Vec3] | None): Every direction detected on the part, best first — the axes of its
            holes and curved walls, the normals of its planes and the axes of its prisms, each both ways round.
            `candidateDirections` were chosen from these, and any other can be added to the part with **Analyze a part**:
            pass it back exactly as served. Null on part results made before this was recorded.
        added_directions (list[Vec3] | None): The directions this run was asked to analyze the part from beyond those
            the directions analysis chose: the part’s added directions when it was queued. One within 0.1° of the exact
            opposite of a direction the part has was added as that exact opposite, which `candidateDirections` holds in its
            place; any other missing from `candidateDirections` added nothing. Null on part results made before this was
            recorded.
        direction_z_bounds (list[DirectionZBounds] | None): Part z extents for each candidate direction, or null when
            detail enrichment did not run.
        turnability (NoAxis | None | TurningAxis): How much of the part one turning setup could finish, or null when no
            reading was taken.
        turning (None | TurningBelowThreshold | TurningNoAxis | TurningNotRequested | TurningSpinFailed |
            TurningTurned): What reading the part for turning came to, or null when no reading was taken. Narrow on `kind`.
        mesh_point_count (int): Number of points in the generated mesh.
        mesh_triangle_count (int): Number of triangles in the generated mesh.
        thumbnail_url (None | str): 15-minute URL for the rendered PNG thumbnail, or null when absent.
        mesh_stl_url (None | str): 15-minute URL for the generated STL mesh, or null when absent.
        mesh_glb_url (None | str): 15-minute URL for the generated GLB mesh, or null when absent.
        file_id (UUID | Unset): **Experimental.** Available now and still gaining functionality. It may change in
            breaking ways in a minor API release; each such change is listed in the release notes, so check them before
            upgrading.

            Identifier of the file this part was made from, absent on a part uploaded on its own and once the file is
            deleted or pruned past the retention window.
        body_index (int | Unset): **Experimental.** Available now and still gaining functionality. It may change in
            breaking ways in a minor API release; each such change is listed in the release notes, so check them before
            upgrading.

            The `index` of the body of its file this part is: of the file it was made from, or the `bodyIndex` it was
            uploaded with. Absent on a part uploaded with none. It stays once the file is deleted or pruned, when `fileId`
            is absent.
    """

    part_id: UUID
    report_id: UUID
    job_id: UUID
    kernel_version: str
    units: ReportUnits
    regions: list[Region]
    features: list[PartFeature]
    candidate_directions: list[Vec3]
    discovered_directions: list[Vec3] | None
    added_directions: list[Vec3] | None
    direction_z_bounds: list[DirectionZBounds] | None
    turnability: NoAxis | None | TurningAxis
    turning: None | TurningBelowThreshold | TurningNoAxis | TurningNotRequested | TurningSpinFailed | TurningTurned
    mesh_point_count: int
    mesh_triangle_count: int
    thumbnail_url: None | str
    mesh_stl_url: None | str
    mesh_glb_url: None | str
    file_id: UUID | Unset = UNSET
    body_index: int | Unset = UNSET
    additional_properties: dict[str, Any] = _attrs_field(init=False, factory=dict)

    def to_dict(self) -> dict[str, Any]:
        from ..models.no_axis import NoAxis
        from ..models.turning_axis import TurningAxis
        from ..models.turning_below_threshold import TurningBelowThreshold
        from ..models.turning_no_axis import TurningNoAxis
        from ..models.turning_not_requested import TurningNotRequested
        from ..models.turning_spin_failed import TurningSpinFailed
        from ..models.turning_turned import TurningTurned

        part_id = str(self.part_id)

        report_id = str(self.report_id)

        job_id = str(self.job_id)

        kernel_version = self.kernel_version

        units = self.units.to_dict()

        regions = []
        for regions_item_data in self.regions:
            regions_item = regions_item_data.to_dict()
            regions.append(regions_item)

        features = []
        for features_item_data in self.features:
            features_item = features_item_data.to_dict()
            features.append(features_item)

        candidate_directions = []
        for candidate_directions_item_data in self.candidate_directions:
            candidate_directions_item = candidate_directions_item_data.to_dict()
            candidate_directions.append(candidate_directions_item)

        discovered_directions: list[dict[str, Any]] | None
        if isinstance(self.discovered_directions, list):
            discovered_directions = []
            for discovered_directions_type_0_item_data in self.discovered_directions:
                discovered_directions_type_0_item = discovered_directions_type_0_item_data.to_dict()
                discovered_directions.append(discovered_directions_type_0_item)

        else:
            discovered_directions = self.discovered_directions

        added_directions: list[dict[str, Any]] | None
        if isinstance(self.added_directions, list):
            added_directions = []
            for added_directions_type_0_item_data in self.added_directions:
                added_directions_type_0_item = added_directions_type_0_item_data.to_dict()
                added_directions.append(added_directions_type_0_item)

        else:
            added_directions = self.added_directions

        direction_z_bounds: list[dict[str, Any]] | None
        if isinstance(self.direction_z_bounds, list):
            direction_z_bounds = []
            for direction_z_bounds_type_0_item_data in self.direction_z_bounds:
                direction_z_bounds_type_0_item = direction_z_bounds_type_0_item_data.to_dict()
                direction_z_bounds.append(direction_z_bounds_type_0_item)

        else:
            direction_z_bounds = self.direction_z_bounds

        turnability: dict[str, Any] | None
        if isinstance(self.turnability, NoAxis):
            turnability = self.turnability.to_dict()
        elif isinstance(self.turnability, TurningAxis):
            turnability = self.turnability.to_dict()
        else:
            turnability = self.turnability

        turning: dict[str, Any] | None
        if isinstance(self.turning, TurningTurned):
            turning = self.turning.to_dict()
        elif isinstance(self.turning, TurningNoAxis):
            turning = self.turning.to_dict()
        elif isinstance(self.turning, TurningBelowThreshold):
            turning = self.turning.to_dict()
        elif isinstance(self.turning, TurningSpinFailed):
            turning = self.turning.to_dict()
        elif isinstance(self.turning, TurningNotRequested):
            turning = self.turning.to_dict()
        else:
            turning = self.turning

        mesh_point_count = self.mesh_point_count

        mesh_triangle_count = self.mesh_triangle_count

        thumbnail_url: None | str
        thumbnail_url = self.thumbnail_url

        mesh_stl_url: None | str
        mesh_stl_url = self.mesh_stl_url

        mesh_glb_url: None | str
        mesh_glb_url = self.mesh_glb_url

        file_id: str | Unset = UNSET
        if not isinstance(self.file_id, Unset):
            file_id = str(self.file_id)

        body_index = self.body_index

        field_dict: dict[str, Any] = {}
        field_dict.update(self.additional_properties)
        field_dict.update(
            {
                "partId": part_id,
                "reportId": report_id,
                "jobId": job_id,
                "kernelVersion": kernel_version,
                "units": units,
                "regions": regions,
                "features": features,
                "candidateDirections": candidate_directions,
                "discoveredDirections": discovered_directions,
                "addedDirections": added_directions,
                "directionZBounds": direction_z_bounds,
                "turnability": turnability,
                "turning": turning,
                "meshPointCount": mesh_point_count,
                "meshTriangleCount": mesh_triangle_count,
                "thumbnailUrl": thumbnail_url,
                "meshStlUrl": mesh_stl_url,
                "meshGlbUrl": mesh_glb_url,
            }
        )
        if file_id is not UNSET:
            field_dict["fileId"] = file_id
        if body_index is not UNSET:
            field_dict["bodyIndex"] = body_index

        return field_dict

    @classmethod
    def from_dict(cls: type[T], src_dict: Mapping[str, Any]) -> T:
        from ..models.direction_z_bounds import DirectionZBounds
        from ..models.no_axis import NoAxis
        from ..models.part_feature import PartFeature
        from ..models.region import Region
        from ..models.report_units import ReportUnits
        from ..models.turning_axis import TurningAxis
        from ..models.turning_below_threshold import TurningBelowThreshold
        from ..models.turning_no_axis import TurningNoAxis
        from ..models.turning_not_requested import TurningNotRequested
        from ..models.turning_spin_failed import TurningSpinFailed
        from ..models.turning_turned import TurningTurned
        from ..models.vec_3 import Vec3

        d = dict(src_dict)
        part_id = UUID(d.pop("partId"))

        report_id = UUID(d.pop("reportId"))

        job_id = UUID(d.pop("jobId"))

        kernel_version = d.pop("kernelVersion")

        units = ReportUnits.from_dict(d.pop("units"))

        regions = []
        _regions = d.pop("regions")
        for regions_item_data in _regions:
            regions_item = Region.from_dict(regions_item_data)

            regions.append(regions_item)

        features = []
        _features = d.pop("features")
        for features_item_data in _features:
            features_item = PartFeature.from_dict(features_item_data)

            features.append(features_item)

        candidate_directions = []
        _candidate_directions = d.pop("candidateDirections")
        for candidate_directions_item_data in _candidate_directions:
            candidate_directions_item = Vec3.from_dict(candidate_directions_item_data)

            candidate_directions.append(candidate_directions_item)

        def _parse_discovered_directions(data: object) -> list[Vec3] | None:
            if data is None:
                return data
            try:
                if not isinstance(data, list):
                    raise TypeError()
                discovered_directions_type_0 = []
                _discovered_directions_type_0 = data
                for discovered_directions_type_0_item_data in _discovered_directions_type_0:
                    discovered_directions_type_0_item = Vec3.from_dict(discovered_directions_type_0_item_data)

                    discovered_directions_type_0.append(discovered_directions_type_0_item)

                return discovered_directions_type_0
            except (TypeError, ValueError, AttributeError, KeyError):
                pass
            return cast(list[Vec3] | None, data)

        discovered_directions = _parse_discovered_directions(d.pop("discoveredDirections"))

        def _parse_added_directions(data: object) -> list[Vec3] | None:
            if data is None:
                return data
            try:
                if not isinstance(data, list):
                    raise TypeError()
                added_directions_type_0 = []
                _added_directions_type_0 = data
                for added_directions_type_0_item_data in _added_directions_type_0:
                    added_directions_type_0_item = Vec3.from_dict(added_directions_type_0_item_data)

                    added_directions_type_0.append(added_directions_type_0_item)

                return added_directions_type_0
            except (TypeError, ValueError, AttributeError, KeyError):
                pass
            return cast(list[Vec3] | None, data)

        added_directions = _parse_added_directions(d.pop("addedDirections"))

        def _parse_direction_z_bounds(data: object) -> list[DirectionZBounds] | None:
            if data is None:
                return data
            try:
                if not isinstance(data, list):
                    raise TypeError()
                direction_z_bounds_type_0 = []
                _direction_z_bounds_type_0 = data
                for direction_z_bounds_type_0_item_data in _direction_z_bounds_type_0:
                    direction_z_bounds_type_0_item = DirectionZBounds.from_dict(direction_z_bounds_type_0_item_data)

                    direction_z_bounds_type_0.append(direction_z_bounds_type_0_item)

                return direction_z_bounds_type_0
            except (TypeError, ValueError, AttributeError, KeyError):
                pass
            return cast(list[DirectionZBounds] | None, data)

        direction_z_bounds = _parse_direction_z_bounds(d.pop("directionZBounds"))

        def _parse_turnability(data: object) -> NoAxis | None | TurningAxis:
            if data is None:
                return data
            try:
                if not isinstance(data, dict):
                    raise TypeError()
                componentsschemas_turnability_type_0 = NoAxis.from_dict(data)

                return componentsschemas_turnability_type_0
            except (TypeError, ValueError, AttributeError, KeyError):
                pass
            try:
                if not isinstance(data, dict):
                    raise TypeError()
                componentsschemas_turnability_type_1 = TurningAxis.from_dict(data)

                return componentsschemas_turnability_type_1
            except (TypeError, ValueError, AttributeError, KeyError):
                pass
            return cast(NoAxis | None | TurningAxis, data)

        turnability = _parse_turnability(d.pop("turnability"))

        def _parse_turning(
            data: object,
        ) -> None | TurningBelowThreshold | TurningNoAxis | TurningNotRequested | TurningSpinFailed | TurningTurned:
            if data is None:
                return data
            try:
                if not isinstance(data, dict):
                    raise TypeError()
                componentsschemas_turning_type_0 = TurningTurned.from_dict(data)

                return componentsschemas_turning_type_0
            except (TypeError, ValueError, AttributeError, KeyError):
                pass
            try:
                if not isinstance(data, dict):
                    raise TypeError()
                componentsschemas_turning_type_1 = TurningNoAxis.from_dict(data)

                return componentsschemas_turning_type_1
            except (TypeError, ValueError, AttributeError, KeyError):
                pass
            try:
                if not isinstance(data, dict):
                    raise TypeError()
                componentsschemas_turning_type_2 = TurningBelowThreshold.from_dict(data)

                return componentsschemas_turning_type_2
            except (TypeError, ValueError, AttributeError, KeyError):
                pass
            try:
                if not isinstance(data, dict):
                    raise TypeError()
                componentsschemas_turning_type_3 = TurningSpinFailed.from_dict(data)

                return componentsschemas_turning_type_3
            except (TypeError, ValueError, AttributeError, KeyError):
                pass
            try:
                if not isinstance(data, dict):
                    raise TypeError()
                componentsschemas_turning_type_4 = TurningNotRequested.from_dict(data)

                return componentsschemas_turning_type_4
            except (TypeError, ValueError, AttributeError, KeyError):
                pass
            return cast(
                None | TurningBelowThreshold | TurningNoAxis | TurningNotRequested | TurningSpinFailed | TurningTurned,
                data,
            )

        turning = _parse_turning(d.pop("turning"))

        mesh_point_count = d.pop("meshPointCount")

        mesh_triangle_count = d.pop("meshTriangleCount")

        def _parse_thumbnail_url(data: object) -> None | str:
            if data is None:
                return data
            return cast(None | str, data)

        thumbnail_url = _parse_thumbnail_url(d.pop("thumbnailUrl"))

        def _parse_mesh_stl_url(data: object) -> None | str:
            if data is None:
                return data
            return cast(None | str, data)

        mesh_stl_url = _parse_mesh_stl_url(d.pop("meshStlUrl"))

        def _parse_mesh_glb_url(data: object) -> None | str:
            if data is None:
                return data
            return cast(None | str, data)

        mesh_glb_url = _parse_mesh_glb_url(d.pop("meshGlbUrl"))

        _file_id = d.pop("fileId", UNSET)
        file_id: UUID | Unset
        if isinstance(_file_id, Unset):
            file_id = UNSET
        else:
            file_id = UUID(_file_id)

        body_index = d.pop("bodyIndex", UNSET)

        part_response = cls(
            part_id=part_id,
            report_id=report_id,
            job_id=job_id,
            kernel_version=kernel_version,
            units=units,
            regions=regions,
            features=features,
            candidate_directions=candidate_directions,
            discovered_directions=discovered_directions,
            added_directions=added_directions,
            direction_z_bounds=direction_z_bounds,
            turnability=turnability,
            turning=turning,
            mesh_point_count=mesh_point_count,
            mesh_triangle_count=mesh_triangle_count,
            thumbnail_url=thumbnail_url,
            mesh_stl_url=mesh_stl_url,
            mesh_glb_url=mesh_glb_url,
            file_id=file_id,
            body_index=body_index,
        )

        part_response.additional_properties = d
        return part_response

    @property
    def additional_keys(self) -> list[str]:
        return list(self.additional_properties.keys())

    def __getitem__(self, key: str) -> Any:
        return self.additional_properties[key]

    def __setitem__(self, key: str, value: Any) -> None:
        self.additional_properties[key] = value

    def __delitem__(self, key: str) -> None:
        del self.additional_properties[key]

    def __contains__(self, key: str) -> bool:
        return key in self.additional_properties
