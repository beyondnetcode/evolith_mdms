namespace Mdm.Presentation.Http;

/// <summary>Cómo se publica un fallo: estado HTTP, <c>code</c> público del contrato y textos para la persona.</summary>
public readonly record struct ProblemSpec(int Status, string Code, string Title, string Detail);
