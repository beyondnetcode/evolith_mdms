namespace Mdm.Application.Test.Common;

using FluentValidation;
using MediatR;
using Mdm.Application.Abstractions.Messaging;
using Mdm.Application.Common.Behaviors;
using Mdm.Domain.Kernel;

public sealed class ValidationBehaviorTest
{
    private sealed record Ping(string Text) : ICommand;

    private sealed record Pong(string Text) : ICommand<int>;

    private sealed record Raw(string Text) : IRequest<string>;

    private sealed class NotEmptyValidator<T> : AbstractValidator<T>
    {
        public NotEmptyValidator(Func<T, string> text)
        {
            RuleFor(x => text(x)).NotEmpty().WithMessage("validation.text_required");
            RuleFor(x => text(x)).MaximumLength(3).WithMessage("validation.text_too_long");
        }
    }

    [Fact]
    public async Task Sin_validadores_continua_con_el_handler()
    {
        var behavior = new ValidationBehavior<Ping, Result>([]);

        var result = await behavior.Handle(new Ping(""), () => Task.FromResult(Result.Success()), CancellationToken.None);

        result.IsSuccess.Should().BeTrue();
    }

    [Fact]
    public async Task Peticion_valida_continua_con_el_handler()
    {
        var behavior = new ValidationBehavior<Ping, Result>([new NotEmptyValidator<Ping>(p => p.Text)]);

        var result = await behavior.Handle(new Ping("ok"), () => Task.FromResult(Result.Success()), CancellationToken.None);

        result.IsSuccess.Should().BeTrue();
    }

    [Fact]
    public async Task Peticion_invalida_devuelve_failure_con_el_primer_codigo_sin_lanzar_ni_llamar_al_handler()
    {
        var called = false;
        var behavior = new ValidationBehavior<Ping, Result>([new NotEmptyValidator<Ping>(p => p.Text)]);

        var result = await behavior.Handle(new Ping(""), () =>
        {
            called = true;
            return Task.FromResult(Result.Success());
        }, CancellationToken.None);

        result.IsFailure.Should().BeTrue();
        result.Error.Should().Be("validation.text_required");
        called.Should().BeFalse();
    }

    [Fact]
    public async Task Respuesta_con_valor_se_convierte_a_result_generico_fallido()
    {
        var behavior = new ValidationBehavior<Pong, Result<int>>([new NotEmptyValidator<Pong>(p => p.Text)]);

        var result = await behavior.Handle(new Pong("demasiado largo"), () => Task.FromResult(Result<int>.Success(1)), CancellationToken.None);

        result.IsFailure.Should().BeTrue();
        result.Error.Should().Be("validation.text_too_long");
    }

    [Fact]
    public async Task Respuesta_que_no_es_result_no_se_puede_construir_y_lanza()
    {
        var behavior = new ValidationBehavior<Raw, string>([new NotEmptyValidator<Raw>(p => p.Text)]);

        var act = () => behavior.Handle(new Raw(""), () => Task.FromResult("x"), CancellationToken.None);

        await act.Should().ThrowAsync<InvalidOperationException>();
    }
}
