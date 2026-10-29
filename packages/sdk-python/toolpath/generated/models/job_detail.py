from __future__ import annotations

import datetime
from collections.abc import Mapping
from typing import TYPE_CHECKING, Any, TypeVar, cast
from uuid import UUID

from attrs import define as _attrs_define
from attrs import field as _attrs_field

from ..models.job_detail_status import JobDetailStatus
from ..types import UNSET, Unset

if TYPE_CHECKING:
    from ..models.job_detail_bodies_item import JobDetailBodiesItem


T = TypeVar("T", bound="JobDetail")


@_attrs_define
class JobDetail:
    """
    Attributes:
        part_uuid (None | UUID): Identifier of the part this job processes, or null when its subject is a holder or a
            file.
        holder_uuid (None | UUID): Identifier of the holder this job processes, or null when its subject is a part or a
            file.
        file_uuid (None | UUID): **Experimental.** Available now and still gaining functionality. It may change in
            breaking ways in a minor API release; each such change is listed in the release notes, so check them before
            upgrading.

            Identifier of the file this job inspects, or null when its subject is a part or a holder.
        job_uuid (UUID): Identifier of this job.
        product_type (str): Product operation performed by the job, such as part processing, feature-detail processing,
            holder import, or file inspection.
        status (JobDetailStatus): Current state of the job: `queued` until a worker starts it, then `running` until it
            finishes, including while it waits to be retried after a failed attempt. `succeeded` and `failed` are final: a
            job in either state never changes again.
        progress (int | None): Worker-reported completion percentage, or null before progress is available.
        retries_remaining (int | None): How many more times the job will be attempted if its current attempt fails,
            counting down to 0 on its last attempt; null until the first attempt starts. A final failure keeps the count
            last recorded, which may remain above 0 or null after queue recovery.
        error (None | str): Failure reason when the job status is failed; otherwise null. Deadline failures say `timed
            out after <n>s`. Queue recovery uses `job_delivery_exhausted`; jobs queued for more than 24 hours fail with
            `job_dispatch_failed`.
        report_id (None | UUID): Identifier of the part result produced by successful processing, or null until
            available.
        import_id (None | UUID): Identifier of the holder result produced by a successful import, or null until
            available.
        created_at (datetime.datetime): Time at which the job was created (queued), in ISO 8601 format.
        updated_at (datetime.datetime): Time of the job’s most recent state change (progress or terminal status), in ISO
            8601 format. Equals `createdAt` for a job that has not yet transitioned.
        duration_ms (int): Wall-clock elapsed from creation to the most recent state change, in milliseconds — the time
            the job has taken to reach its current state (queue wait included).
        bodies (list[JobDetailBodiesItem] | Unset): **Experimental.** Available now and still gaining functionality. It
            may change in breaking ways in a minor API release; each such change is listed in the release notes, so check
            them before upgrading.

            The solid bodies of the part’s file, listed when the job failed because the file holds more than one and none
            was chosen (`error` beginning `multiple_bodies:`), or because the `bodyIndex` chosen is past the last
            (`body_not_found:`). Upload the file again with **Upload a part** (`POST /v1/parts`), passing `bodyIndex` as the
            `index` of the body to machine. Absent on every other job.
    """

    part_uuid: None | UUID
    holder_uuid: None | UUID
    file_uuid: None | UUID
    job_uuid: UUID
    product_type: str
    status: JobDetailStatus
    progress: int | None
    retries_remaining: int | None
    error: None | str
    report_id: None | UUID
    import_id: None | UUID
    created_at: datetime.datetime
    updated_at: datetime.datetime
    duration_ms: int
    bodies: list[JobDetailBodiesItem] | Unset = UNSET
    additional_properties: dict[str, Any] = _attrs_field(init=False, factory=dict)

    def to_dict(self) -> dict[str, Any]:
        part_uuid: None | str
        if isinstance(self.part_uuid, UUID):
            part_uuid = str(self.part_uuid)
        else:
            part_uuid = self.part_uuid

        holder_uuid: None | str
        if isinstance(self.holder_uuid, UUID):
            holder_uuid = str(self.holder_uuid)
        else:
            holder_uuid = self.holder_uuid

        file_uuid: None | str
        if isinstance(self.file_uuid, UUID):
            file_uuid = str(self.file_uuid)
        else:
            file_uuid = self.file_uuid

        job_uuid = str(self.job_uuid)

        product_type = self.product_type

        status = self.status.value

        progress: int | None
        progress = self.progress

        retries_remaining: int | None
        retries_remaining = self.retries_remaining

        error: None | str
        error = self.error

        report_id: None | str
        if isinstance(self.report_id, UUID):
            report_id = str(self.report_id)
        else:
            report_id = self.report_id

        import_id: None | str
        if isinstance(self.import_id, UUID):
            import_id = str(self.import_id)
        else:
            import_id = self.import_id

        created_at = self.created_at.isoformat()

        updated_at = self.updated_at.isoformat()

        duration_ms = self.duration_ms

        bodies: list[dict[str, Any]] | Unset = UNSET
        if not isinstance(self.bodies, Unset):
            bodies = []
            for bodies_item_data in self.bodies:
                bodies_item = bodies_item_data.to_dict()
                bodies.append(bodies_item)

        field_dict: dict[str, Any] = {}
        field_dict.update(self.additional_properties)
        field_dict.update(
            {
                "partUuid": part_uuid,
                "holderUuid": holder_uuid,
                "fileUuid": file_uuid,
                "jobUuid": job_uuid,
                "productType": product_type,
                "status": status,
                "progress": progress,
                "retriesRemaining": retries_remaining,
                "error": error,
                "reportId": report_id,
                "importId": import_id,
                "createdAt": created_at,
                "updatedAt": updated_at,
                "durationMs": duration_ms,
            }
        )
        if bodies is not UNSET:
            field_dict["bodies"] = bodies

        return field_dict

    @classmethod
    def from_dict(cls: type[T], src_dict: Mapping[str, Any]) -> T:
        from ..models.job_detail_bodies_item import JobDetailBodiesItem

        d = dict(src_dict)

        def _parse_part_uuid(data: object) -> None | UUID:
            if data is None:
                return data
            try:
                if not isinstance(data, str):
                    raise TypeError()
                part_uuid_type_0 = UUID(data)

                return part_uuid_type_0
            except (TypeError, ValueError, AttributeError, KeyError):
                pass
            return cast(None | UUID, data)

        part_uuid = _parse_part_uuid(d.pop("partUuid"))

        def _parse_holder_uuid(data: object) -> None | UUID:
            if data is None:
                return data
            try:
                if not isinstance(data, str):
                    raise TypeError()
                holder_uuid_type_0 = UUID(data)

                return holder_uuid_type_0
            except (TypeError, ValueError, AttributeError, KeyError):
                pass
            return cast(None | UUID, data)

        holder_uuid = _parse_holder_uuid(d.pop("holderUuid"))

        def _parse_file_uuid(data: object) -> None | UUID:
            if data is None:
                return data
            try:
                if not isinstance(data, str):
                    raise TypeError()
                file_uuid_type_0 = UUID(data)

                return file_uuid_type_0
            except (TypeError, ValueError, AttributeError, KeyError):
                pass
            return cast(None | UUID, data)

        file_uuid = _parse_file_uuid(d.pop("fileUuid"))

        job_uuid = UUID(d.pop("jobUuid"))

        product_type = d.pop("productType")

        status = JobDetailStatus(d.pop("status"))

        def _parse_progress(data: object) -> int | None:
            if data is None:
                return data
            return cast(int | None, data)

        progress = _parse_progress(d.pop("progress"))

        def _parse_retries_remaining(data: object) -> int | None:
            if data is None:
                return data
            return cast(int | None, data)

        retries_remaining = _parse_retries_remaining(d.pop("retriesRemaining"))

        def _parse_error(data: object) -> None | str:
            if data is None:
                return data
            return cast(None | str, data)

        error = _parse_error(d.pop("error"))

        def _parse_report_id(data: object) -> None | UUID:
            if data is None:
                return data
            try:
                if not isinstance(data, str):
                    raise TypeError()
                report_id_type_0 = UUID(data)

                return report_id_type_0
            except (TypeError, ValueError, AttributeError, KeyError):
                pass
            return cast(None | UUID, data)

        report_id = _parse_report_id(d.pop("reportId"))

        def _parse_import_id(data: object) -> None | UUID:
            if data is None:
                return data
            try:
                if not isinstance(data, str):
                    raise TypeError()
                import_id_type_0 = UUID(data)

                return import_id_type_0
            except (TypeError, ValueError, AttributeError, KeyError):
                pass
            return cast(None | UUID, data)

        import_id = _parse_import_id(d.pop("importId"))

        created_at = datetime.datetime.fromisoformat(d.pop("createdAt"))

        updated_at = datetime.datetime.fromisoformat(d.pop("updatedAt"))

        duration_ms = d.pop("durationMs")

        _bodies = d.pop("bodies", UNSET)
        bodies: list[JobDetailBodiesItem] | Unset = UNSET
        if _bodies is not UNSET:
            bodies = []
            for bodies_item_data in _bodies:
                bodies_item = JobDetailBodiesItem.from_dict(bodies_item_data)

                bodies.append(bodies_item)

        job_detail = cls(
            part_uuid=part_uuid,
            holder_uuid=holder_uuid,
            file_uuid=file_uuid,
            job_uuid=job_uuid,
            product_type=product_type,
            status=status,
            progress=progress,
            retries_remaining=retries_remaining,
            error=error,
            report_id=report_id,
            import_id=import_id,
            created_at=created_at,
            updated_at=updated_at,
            duration_ms=duration_ms,
            bodies=bodies,
        )

        job_detail.additional_properties = d
        return job_detail

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
