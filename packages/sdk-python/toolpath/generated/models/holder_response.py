from __future__ import annotations

from collections.abc import Mapping
from typing import TYPE_CHECKING, Any, TypeVar, cast
from uuid import UUID

from attrs import define as _attrs_define
from attrs import field as _attrs_field

from ..models.holder_response_taper_family_type_1 import HolderResponseTaperFamilyType1
from ..models.holder_response_taper_family_type_2_type_1 import HolderResponseTaperFamilyType2Type1
from ..models.holder_response_taper_family_type_3_type_1 import HolderResponseTaperFamilyType3Type1

if TYPE_CHECKING:
    from ..models.cone import Cone
    from ..models.holder_response_axis_direction import HolderResponseAxisDirection
    from ..models.holder_response_axis_location import HolderResponseAxisLocation
    from ..models.holder_response_nose import HolderResponseNose
    from ..models.holder_response_options import HolderResponseOptions
    from ..models.holder_response_units import HolderResponseUnits


T = TypeVar("T", bound="HolderResponse")


@_attrs_define
class HolderResponse:
    """
    Attributes:
        holder_id (UUID): Identifier of this holder.
        import_id (UUID): Identifier of this immutable holder result.
        job_id (UUID): Identifier of the import job that produced this holder result.
        kernel_version (str): Version of the Toolpath kernel that produced this holder result.
        units (HolderResponseUnits): Units used by all dimensional values in this holder response.
        options (HolderResponseOptions): The import options this result was produced with.
        layers (list[Cone]): The collision envelope as a stack of cones, nose first — the solid the holder sweeps as the
            spindle turns it, not the modeled solid. Wrench flats, coolant bores and nut slots are inside it by
            construction. Always the complete envelope, taper included; a gauge-plane cut is an export option on `GET
            /v1/holders/{id}/fusion`.
        gauge_length (float | None): Distance from the bottom of the stack to the gauge plane, in mm, or null when it
            was not measured. Null is not zero: a straight shank or a Capto carries no cone to place a gauge plane on.
        size_class (int | None): The spindle taper’s nominal size — 30, 40 or 50 for a 7:24, one of 25 through 160 for
            an HSK — or null when no taper was found. A size, not a holder: geometry cannot tell BT40 from CAT40 from ISO40.
        taper_family (HolderResponseTaperFamilyType1 | HolderResponseTaperFamilyType2Type1 |
            HolderResponseTaperFamilyType3Type1 | None): Which interface `sizeClass` belongs to, or null when no taper was
            found. Read the two together: an HSK40 and an ISO40 are both 40 and are otherwise nothing alike.
        axis_direction (HolderResponseAxisDirection): The axis the holder turns about, as a unit vector in the file’s
            coordinates. Its sign is arbitrary — it says nothing about which end goes in the spindle. The holder runs nose
            to spindle along it unless `flipped`.
        axis_location (HolderResponseAxisLocation): A point on that axis, purely radial. With `nose` it is what puts the
            layer stack back on the geometry it was measured from.
        nose (HolderResponseNose): Where the holder’s nose sits, in the file’s coordinates. The layer stack starts here.
        axis_area_fraction (float | None): Share of the file’s surface area carried by faces agreeing on the axis, or
            null when not measured. Low is a warning: a holder something is wrong with, not a holder measured badly.
        face_count (int): Faces across every body in the file — evidence the holder arrived intact rather than as the
            three faces of a failed translation.
        sample_count (int): Envelope bins before simplification. Against the length of `layers` it says how much of the
            holder was groove detail.
        flipped (bool): Whether the file models the holder spindle-end first.
        taper_at_nose (bool): Whether the taper sits at the nose end of the stack instead of the spindle end, which
            happens only when the `flipped` option turned the holder away from the detected cone.
        mesh_point_count (int): Number of points in the generated envelope mesh.
        mesh_triangle_count (int): Number of triangles in the generated envelope mesh.
        thumbnail_url (None | str): 15-minute URL for the rendered PNG thumbnail, or null when absent.
        mesh_stl_url (None | str): 15-minute URL for the generated STL envelope mesh, or null when absent.
        mesh_glb_url (None | str): 15-minute URL for the generated GLB envelope mesh, or null when absent.
        fusion_available (bool): Whether an Autodesk Fusion holder definition is available for download at `GET
            /v1/holders/{id}/fusion`.
        fusion_trimmed_available (bool): Whether that download can serve an envelope cut at the gauge plane. False when
            there was nothing to cut at — no gauge plane was measured, or a flip put the taper at the nose — in which case
            `trim=true` serves the complete envelope.
    """

    holder_id: UUID
    import_id: UUID
    job_id: UUID
    kernel_version: str
    units: HolderResponseUnits
    options: HolderResponseOptions
    layers: list[Cone]
    gauge_length: float | None
    size_class: int | None
    taper_family: (
        HolderResponseTaperFamilyType1
        | HolderResponseTaperFamilyType2Type1
        | HolderResponseTaperFamilyType3Type1
        | None
    )
    axis_direction: HolderResponseAxisDirection
    axis_location: HolderResponseAxisLocation
    nose: HolderResponseNose
    axis_area_fraction: float | None
    face_count: int
    sample_count: int
    flipped: bool
    taper_at_nose: bool
    mesh_point_count: int
    mesh_triangle_count: int
    thumbnail_url: None | str
    mesh_stl_url: None | str
    mesh_glb_url: None | str
    fusion_available: bool
    fusion_trimmed_available: bool
    additional_properties: dict[str, Any] = _attrs_field(init=False, factory=dict)

    def to_dict(self) -> dict[str, Any]:
        holder_id = str(self.holder_id)

        import_id = str(self.import_id)

        job_id = str(self.job_id)

        kernel_version = self.kernel_version

        units = self.units.to_dict()

        options = self.options.to_dict()

        layers = []
        for layers_item_data in self.layers:
            layers_item = layers_item_data.to_dict()
            layers.append(layers_item)

        gauge_length: float | None
        gauge_length = self.gauge_length

        size_class: int | None
        size_class = self.size_class

        taper_family: None | str
        if isinstance(self.taper_family, HolderResponseTaperFamilyType1):
            taper_family = self.taper_family.value
        elif isinstance(self.taper_family, HolderResponseTaperFamilyType2Type1):
            taper_family = self.taper_family.value
        elif isinstance(self.taper_family, HolderResponseTaperFamilyType3Type1):
            taper_family = self.taper_family.value
        else:
            taper_family = self.taper_family

        axis_direction = self.axis_direction.to_dict()

        axis_location = self.axis_location.to_dict()

        nose = self.nose.to_dict()

        axis_area_fraction: float | None
        axis_area_fraction = self.axis_area_fraction

        face_count = self.face_count

        sample_count = self.sample_count

        flipped = self.flipped

        taper_at_nose = self.taper_at_nose

        mesh_point_count = self.mesh_point_count

        mesh_triangle_count = self.mesh_triangle_count

        thumbnail_url: None | str
        thumbnail_url = self.thumbnail_url

        mesh_stl_url: None | str
        mesh_stl_url = self.mesh_stl_url

        mesh_glb_url: None | str
        mesh_glb_url = self.mesh_glb_url

        fusion_available = self.fusion_available

        fusion_trimmed_available = self.fusion_trimmed_available

        field_dict: dict[str, Any] = {}
        field_dict.update(self.additional_properties)
        field_dict.update(
            {
                "holderId": holder_id,
                "importId": import_id,
                "jobId": job_id,
                "kernelVersion": kernel_version,
                "units": units,
                "options": options,
                "layers": layers,
                "gaugeLength": gauge_length,
                "sizeClass": size_class,
                "taperFamily": taper_family,
                "axisDirection": axis_direction,
                "axisLocation": axis_location,
                "nose": nose,
                "axisAreaFraction": axis_area_fraction,
                "faceCount": face_count,
                "sampleCount": sample_count,
                "flipped": flipped,
                "taperAtNose": taper_at_nose,
                "meshPointCount": mesh_point_count,
                "meshTriangleCount": mesh_triangle_count,
                "thumbnailUrl": thumbnail_url,
                "meshStlUrl": mesh_stl_url,
                "meshGlbUrl": mesh_glb_url,
                "fusionAvailable": fusion_available,
                "fusionTrimmedAvailable": fusion_trimmed_available,
            }
        )

        return field_dict

    @classmethod
    def from_dict(cls: type[T], src_dict: Mapping[str, Any]) -> T:
        from ..models.cone import Cone
        from ..models.holder_response_axis_direction import HolderResponseAxisDirection
        from ..models.holder_response_axis_location import HolderResponseAxisLocation
        from ..models.holder_response_nose import HolderResponseNose
        from ..models.holder_response_options import HolderResponseOptions
        from ..models.holder_response_units import HolderResponseUnits

        d = dict(src_dict)
        holder_id = UUID(d.pop("holderId"))

        import_id = UUID(d.pop("importId"))

        job_id = UUID(d.pop("jobId"))

        kernel_version = d.pop("kernelVersion")

        units = HolderResponseUnits.from_dict(d.pop("units"))

        options = HolderResponseOptions.from_dict(d.pop("options"))

        layers = []
        _layers = d.pop("layers")
        for layers_item_data in _layers:
            layers_item = Cone.from_dict(layers_item_data)

            layers.append(layers_item)

        def _parse_gauge_length(data: object) -> float | None:
            if data is None:
                return data
            return cast(float | None, data)

        gauge_length = _parse_gauge_length(d.pop("gaugeLength"))

        def _parse_size_class(data: object) -> int | None:
            if data is None:
                return data
            return cast(int | None, data)

        size_class = _parse_size_class(d.pop("sizeClass"))

        def _parse_taper_family(
            data: object,
        ) -> (
            HolderResponseTaperFamilyType1
            | HolderResponseTaperFamilyType2Type1
            | HolderResponseTaperFamilyType3Type1
            | None
        ):
            if data is None:
                return data
            try:
                if not isinstance(data, str):
                    raise TypeError()
                taper_family_type_1 = HolderResponseTaperFamilyType1(data)

                return taper_family_type_1
            except (TypeError, ValueError, AttributeError, KeyError):
                pass
            try:
                if not isinstance(data, str):
                    raise TypeError()
                taper_family_type_2_type_1 = HolderResponseTaperFamilyType2Type1(data)

                return taper_family_type_2_type_1
            except (TypeError, ValueError, AttributeError, KeyError):
                pass
            try:
                if not isinstance(data, str):
                    raise TypeError()
                taper_family_type_3_type_1 = HolderResponseTaperFamilyType3Type1(data)

                return taper_family_type_3_type_1
            except (TypeError, ValueError, AttributeError, KeyError):
                pass
            return cast(
                HolderResponseTaperFamilyType1
                | HolderResponseTaperFamilyType2Type1
                | HolderResponseTaperFamilyType3Type1
                | None,
                data,
            )

        taper_family = _parse_taper_family(d.pop("taperFamily"))

        axis_direction = HolderResponseAxisDirection.from_dict(d.pop("axisDirection"))

        axis_location = HolderResponseAxisLocation.from_dict(d.pop("axisLocation"))

        nose = HolderResponseNose.from_dict(d.pop("nose"))

        def _parse_axis_area_fraction(data: object) -> float | None:
            if data is None:
                return data
            return cast(float | None, data)

        axis_area_fraction = _parse_axis_area_fraction(d.pop("axisAreaFraction"))

        face_count = d.pop("faceCount")

        sample_count = d.pop("sampleCount")

        flipped = d.pop("flipped")

        taper_at_nose = d.pop("taperAtNose")

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

        fusion_available = d.pop("fusionAvailable")

        fusion_trimmed_available = d.pop("fusionTrimmedAvailable")

        holder_response = cls(
            holder_id=holder_id,
            import_id=import_id,
            job_id=job_id,
            kernel_version=kernel_version,
            units=units,
            options=options,
            layers=layers,
            gauge_length=gauge_length,
            size_class=size_class,
            taper_family=taper_family,
            axis_direction=axis_direction,
            axis_location=axis_location,
            nose=nose,
            axis_area_fraction=axis_area_fraction,
            face_count=face_count,
            sample_count=sample_count,
            flipped=flipped,
            taper_at_nose=taper_at_nose,
            mesh_point_count=mesh_point_count,
            mesh_triangle_count=mesh_triangle_count,
            thumbnail_url=thumbnail_url,
            mesh_stl_url=mesh_stl_url,
            mesh_glb_url=mesh_glb_url,
            fusion_available=fusion_available,
            fusion_trimmed_available=fusion_trimmed_available,
        )

        holder_response.additional_properties = d
        return holder_response

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
