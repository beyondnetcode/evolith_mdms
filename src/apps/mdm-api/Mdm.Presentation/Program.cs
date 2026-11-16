using Mdm.Application;
using Mdm.Infrastructure;
using Mdm.Presentation.Endpoints.Health;
using Mdm.Presentation.Endpoints.Organization;
using Mdm.Presentation.Http;
using Mdm.Presentation.Security;

var builder = WebApplication.CreateBuilder(args);

// Errores como application/problem+json (RFC 9457) en toda la API, incluidas las excepciones no
// controladas y los 401/403/404 que genera el framework: todos llevan `type` y `code`.
builder.Services.AddProblemDetails(options =>
    options.CustomizeProblemDetails = context => ProblemDetailsDefaults.Apply(context.HttpContext, context.ProblemDetails));
builder.Services.AddExceptionHandler<BadRequestExceptionHandler>();
builder.Services.ConfigureHttpJsonOptions(options =>
    options.SerializerOptions.Converters.Add(new Iso8601MillisecondsConverter()));

builder.Services.AddApplication();
builder.Services.AddInfrastructure(builder.Configuration);
builder.Services.AddMdmAuthentication(builder.Environment);

var app = builder.Build();

app.UseExceptionHandler();
app.UseStatusCodePages();
app.UseAuthentication();
app.UseAuthorization();

app.MapHealthEndpoints();
app.MapOrganizationEndpoints();

await app.RunAsync();

namespace Mdm.Presentation
{
    /// <summary>Punto de entrada, expuesto para WebApplicationFactory en las pruebas de integración.</summary>
    public partial class Program;
}
