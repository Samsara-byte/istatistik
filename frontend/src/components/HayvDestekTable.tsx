import PivotDestekTable from "./PivotDestekTable";

export default function HayvDestekTable() {
  return (
    <PivotDestekTable
      endpoint="hayvancilik-destek"
      title="Hayvancılık Destekleri"
      excelSheet="Hayvancılık Destekleri"
      excelFile="hayvancilik_destek"
    />
  );
}
