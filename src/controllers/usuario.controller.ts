import {
  Count,
  CountSchema,
  Filter,
  FilterExcludingWhere,
  repository,
  Where,
} from '@loopback/repository';
import {
  post,
  param,
  get,
  getModelSchemaRef,
  patch,
  put,
  del,
  requestBody,
  response,
  HttpErrors,
} from '@loopback/rest';
import {Credenciales, Login, PermisosRolMenu, Usuario} from '../models';
import {LoginRepository, UsuarioRepository} from '../repositories';
import {AuthService, SeguridadUsuarioService} from '../services';
import { service } from '@loopback/core';
import {FactorDeAuntenticacionPorCodigo} from '../models/factor-de-auntenticacion-por-codigo.model';
import {authenticate} from '@loopback/authentication';
import {ConfiguracionSeguridad} from '../config/seguridad.config';
import {UserProfile} from '@loopback/security';


export class UsuarioController {
  constructor(
    @repository(UsuarioRepository)
    public usuarioRepository : UsuarioRepository,
    @service(SeguridadUsuarioService)
    public servicioSeguridad : SeguridadUsuarioService,
    @repository(LoginRepository)
    public respositorioLogin : LoginRepository,
    @service(AuthService)
    private servicioAuth: AuthService
  ) {}

  @post('/usuario')
  @response(200, {
    description: 'Usuario model instance',
    content: {'application/json': {schema: getModelSchemaRef(Usuario)}},
  })
  async create(
    @requestBody({
      content: {
        'application/json': {
          schema: getModelSchemaRef(Usuario, {
            title: 'NewUsuario',
            exclude: ['_id'],
          }),
        },
      },
    })
    usuario: Omit<Usuario, '_id'>,
  ): Promise<Usuario> {
    // Crear la clave
    const clave = this.servicioSeguridad.crearTextoAleatorio(10);
    console.log(clave);
    // Cifrar la clave
    const claveCifrada = this.servicioSeguridad.cifrarTexto(clave);
    // Asignar la clave cifrada al usuario
    usuario.clave = claveCifrada;
    // enviar correo electronico de notificación
    return this.usuarioRepository.create(usuario);
  }

  @get('/usuario/count')
  @response(200, {
    description: 'Usuario model count',
    content: {'application/json': {schema: CountSchema}},
  })
  async count(
    @param.where(Usuario) where?: Where<Usuario>,
  ): Promise<Count> {
    return this.usuarioRepository.count(where);
  }

  @authenticate({
    strategy: 'auth',
    options:[ConfiguracionSeguridad.menuUsuarioId, ConfiguracionSeguridad.listarAccion]
  })
  @get('/usuario')
  @response(200, {
    description: 'Array of Usuario model instances',
    content: {
      'application/json': {
        schema: {
          type: 'array',
          items: getModelSchemaRef(Usuario, {includeRelations: true}),
        },
      },
    },
  })
  async find(
    @param.filter(Usuario) filter?: Filter<Usuario>,
  ): Promise<Usuario[]> {
    return this.usuarioRepository.find(filter);
  }


  @patch('/usuario')
  @response(200, {
    description: 'Usuario PATCH success count',
    content: {'application/json': {schema: CountSchema}},
  })
  async updateAll(
    @requestBody({
      content: {
        'application/json': {
          schema: getModelSchemaRef(Usuario, {partial: true}),
        },
      },
    })
    usuario: Usuario,
    @param.where(Usuario) where?: Where<Usuario>,
  ): Promise<Count> {
    return this.usuarioRepository.updateAll(usuario, where);
  }

  @get('/usuario/{id}')
  @response(200, {
    description: 'Usuario model instance',
    content: {
      'application/json': {
        schema: getModelSchemaRef(Usuario, {includeRelations: true}),
      },
    },
  })
  async findById(
    @param.path.string('id') id: string,
    @param.filter(Usuario, {exclude: 'where'}) filter?: FilterExcludingWhere<Usuario>
  ): Promise<Usuario> {
    return this.usuarioRepository.findById(id, filter);
  }

  @patch('/usuario/{id}')
  @response(204, {
    description: 'Usuario PATCH success',
  })
  async updateById(
    @param.path.string('id') id: string,
    @requestBody({
      content: {
        'application/json': {
          schema: getModelSchemaRef(Usuario, {partial: true}),
        },
      },
    })
    usuario: Usuario,
  ): Promise<void> {
    await this.usuarioRepository.updateById(id, usuario);
  }

  @put('/usuario/{id}')
  @response(204, {
    description: 'Usuario PUT success',
  })
  async replaceById(
    @param.path.string('id') id: string,
    @requestBody() usuario: Usuario,
  ): Promise<void> {
    await this.usuarioRepository.replaceById(id, usuario);
  }

  @del('/usuario/{id}')
  @response(204, {
    description: 'Usuario DELETE success',
  })
  async deleteById(@param.path.string('id') id: string): Promise<void> {
    await this.usuarioRepository.deleteById(id);
  }

  /**
   * Metodos personalizado para la API
  */

  @post('/identificar-usuario')
  @response(200, {
    description: 'Identificar un usuario por correo y clave',
    content: {'application/json': {schema: getModelSchemaRef(Usuario)}}
  })
  async identificarUsuario(
  @requestBody(
    {
      content: {
        'application/json': {
         schema: getModelSchemaRef(Credenciales)
        }
      }
    }
  )
  credenciales: Credenciales
  ): Promise<object> {
    const usuario = await this.servicioSeguridad.identificarUsuario(credenciales);
    if(usuario){
      const codigo2fa = this.servicioSeguridad.crearTextoAleatorio(5);
      const login: Login = new Login();
      login.usuarioId = usuario._id!;
      login.codigo2fa = codigo2fa;
      login.estadoCodigo2fa = false;
      login.token = '';
      login.estadoToken = false;
      await this.respositorioLogin.create(login);
      usuario.clave = ''; // Ocultar clave del usuario
      // Notificar al usuario via correo o sms
      return usuario
    }
  return new HttpErrors[401]("Las credenciales no son correctas");
  }

  @post('/validar-permisos')
  @response(200, {
    description: 'Validacion de permisos de usuario para logica de negocio',
    content: {'application/json': {schema: getModelSchemaRef(PermisosRolMenu)}}
  })
  async ValidarPermisosdeUusario(
  @requestBody(
    {
      content: {
        'application/json': {
         schema: getModelSchemaRef(PermisosRolMenu)
        }
      }
    }
  )
  datos: PermisosRolMenu
  ): Promise<UserProfile | undefined> {
    const idRol = this.servicioSeguridad.obtenerRolDesdeToken(datos.token);
    return this.servicioAuth.VerificarPermisoDeUsuarioPorRol(idRol, datos.idMenu, datos.accion);
  }

  @post('/verificar-2fa')
  @response(200, {
    description: 'Verificar el código 2FA',
  })
  async verificarCodigo2fa(
    @requestBody(
      {
        content: {
          'application/json': {
          schema: getModelSchemaRef(FactorDeAuntenticacionPorCodigo)
          }
        }
      }
   )
    credenciales: FactorDeAuntenticacionPorCodigo
  ): Promise<object> {
    const usuario = await this.servicioSeguridad.validarCodigo2fa(credenciales);
    if (usuario){
      const token = this.servicioSeguridad.crearToken(usuario);
      if (usuario){
        usuario.clave = ''; // Ocultar clave del usuario
        try{
          await this.usuarioRepository.logins(usuario._id).patch({
            estadoCodigo2fa: true,
            token: token
          },
          {
            estadoCodigo2fa: false
          })
        } catch {
        console.log("No se ha almacenado el cambio de estado en la base de datos");
        }
        return {
          user: usuario,
          token: token
        };
      }
    }
    return new HttpErrors[401]("Codigo de 2fa no valido");
  }

}
